'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { AskPlatoVueTabV2 } from './AskPlatoVueTabV2';
import { buildHMFactTables } from '../../services/hmFactTables';
import { calculatePendingActions } from '../../services/hmMetricsEngine';
import { saveManualActions, loadManualActions } from '../../services/actionQueueService';
import { DEFAULT_HM_RULES } from '../../config/hmRules';
import { ActionItem } from '../../types/actionTypes';
import { TrendingUp, Users, AlertTriangle, Lightbulb, MessageSquareText } from 'lucide-react';

interface AskPlatoVueV2Props {
  onNavigateToTab?: (tab: string, params?: Record<string, string>) => void;
}

// V0 Design: Suggested questions for empty state
const suggestedQuestions = [
  {
    icon: <TrendingUp className="w-4 h-4" />,
    question: "What's causing our engineering pipeline slowdown?",
    category: 'Pipeline Analysis',
  },
  {
    icon: <Users className="w-4 h-4" />,
    question: "Which recruiters have capacity for new reqs?",
    category: 'Capacity',
  },
  {
    icon: <AlertTriangle className="w-4 h-4" />,
    question: "What are our top 3 hiring risks this quarter?",
    category: 'Risk Assessment',
  },
  {
    icon: <Lightbulb className="w-4 h-4" />,
    question: "How can we improve our offer acceptance rate?",
    category: 'Optimization',
  },
];

// Empty state shown when no data is loaded (V0 Design)
function AskEmptyState() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto min-h-[calc(100vh-200px)]">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight mb-1">
          Ask PlatoVue
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Ask questions about your recruiting data in plain English
        </p>
      </div>

      {/* Empty State Content */}
      <div className="bg-card/70 backdrop-blur-sm rounded-xl border border-border p-8 flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mb-6">
          <MessageSquareText className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Import data to get started</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center mb-8">
          Ask PlatoVue uses your recruiting data to provide personalized insights and recommendations.
          Import your data to unlock these features.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-50 pointer-events-none max-w-2xl">
          {suggestedQuestions.map((item) => (
            <div
              key={item.question}
              className="text-left p-4 rounded-lg bg-card/90 border border-border"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-primary">{item.icon}</span>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.category}
                </span>
              </div>
              <p className="text-sm text-foreground">
                {item.question}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AskPlatoVueV2({ onNavigateToTab }: AskPlatoVueV2Props) {
  const { state, aiConfig, isAiEnabled } = useDashboard();
  const [manualActions, setManualActions] = useState<ActionItem[]>([]);

  // Generate a stable dataset ID from import timestamp
  const datasetId = useMemo(() => {
    if (state.dataStore.lastImportAt) {
      return `dataset_${state.dataStore.lastImportAt.getTime()}`;
    }
    return 'dataset_default';
  }, [state.dataStore.lastImportAt]);

  // Load persisted manual actions on mount / when datasetId changes
  useEffect(() => {
    const persisted = loadManualActions(datasetId);
    if (persisted.length > 0) {
      setManualActions(persisted);
      console.log('[AskPlatoVueV2] Loaded', persisted.length, 'persisted manual actions');
    }
  }, [datasetId]);

  // Calculate HM actions from fact tables
  const hmActions = useMemo(() => {
    if (!state.dataStore.requisitions.length) return [];

    const factTables = buildHMFactTables(
      state.dataStore.requisitions,
      state.dataStore.candidates,
      state.dataStore.events,
      state.dataStore.users,
      state.dataStore.config.stageMapping,
      state.dataStore.lastImportAt || new Date()
    );
    return calculatePendingActions(factTables, state.dataStore.users, DEFAULT_HM_RULES);
  }, [state.dataStore]);

  // Handle adding manual actions - save to state AND localStorage
  const handleAddManualActions = useCallback((newActions: ActionItem[]) => {
    setManualActions((prev) => {
      const existingIds = new Set(prev.map(a => a.action_id));
      const uniqueNew = newActions.filter(a => !existingIds.has(a.action_id));

      if (uniqueNew.length > 0) {
        // Persist to localStorage
        saveManualActions(datasetId, uniqueNew);
        console.log('[AskPlatoVueV2] Saved', uniqueNew.length, 'new actions to localStorage');
      }

      return [...prev, ...uniqueNew];
    });
  }, [datasetId]);

  // Default navigation handler if none provided
  const handleNavigateToTab = useCallback((tab: string, params?: Record<string, string>) => {
    if (onNavigateToTab) {
      onNavigateToTab(tab, params);
    }
    // Log navigation for debugging
    console.log('[AskPlatoVueV2] Navigate to tab:', tab, params ? `with params: ${JSON.stringify(params)}` : '');
  }, [onNavigateToTab]);

  // Combine HM actions with manual actions for deduplication
  // IMPORTANT: This must be above the early return to comply with React hooks rules
  const existingActions = useMemo(() => {
    // Convert HM pending actions to ActionItem format for deduplication
    const hmActionItems: ActionItem[] = hmActions.map(action => ({
      action_id: `hm_${action.hmUserId}_${action.reqId}_${action.actionType}`,
      owner_type: 'HIRING_MANAGER',
      owner_id: action.hmUserId,
      owner_name: action.hmName,
      req_id: action.reqId,
      req_title: action.reqTitle,
      action_type: action.actionType as any,
      title: action.suggestedAction,
      priority: action.daysOverdue > 3 ? 'P0' : action.daysOverdue > 0 ? 'P1' : 'P2',
      due_in_days: -action.daysOverdue,
      due_date: new Date(),
      evidence: {
        kpi_key: 'hm_latency',
        explain_provider_key: 'hm_friction',
        short_reason: `${action.daysOverdue}d overdue`,
      },
      recommended_steps: [],
      created_at: new Date(),
      status: 'OPEN',
    }));
    return [...hmActionItems, ...manualActions];
  }, [hmActions, manualActions]);

  // Show empty state if no data loaded
  if (!state.loadingState.hasOverviewMetrics || !state.overview) {
    return <AskEmptyState />;
  }

  // Use the new Tailwind-based Ask PlatoVue component
  return (
    <AskPlatoVueTabV2
      onNavigateToTab={handleNavigateToTab}
      onAddActions={handleAddManualActions}
      existingActions={existingActions}
    />
  );
}

export default AskPlatoVueV2;
