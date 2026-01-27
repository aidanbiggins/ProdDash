'use client';

import React, { useMemo, useState } from 'react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { AskPlatoVueTabV2 } from './AskPlatoVueTabV2';
import { buildHMFactTables } from '../../services/hmFactTables';
import { calculatePendingActions } from '../../services/hmMetricsEngine';
import { DEFAULT_HM_RULES } from '../../config/hmRules';
import { ActionItem } from '../../types/actionTypes';
import { Sparkles, Bot, TrendingUp, Users, AlertTriangle, Lightbulb, MessageSquareText } from 'lucide-react';

interface AskPlatoVueV2Props {
  onNavigateToTab?: (tab: string) => void;
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
        <h1 className="text-xl md:text-2xl font-bold text-[#f8fafc] tracking-tight mb-1">
          Ask PlatoVue
        </h1>
        <p className="text-xs md:text-sm text-[#94a3b8]">
          Ask questions about your recruiting data in plain English
        </p>
      </div>

      {/* Empty State Content */}
      <div className="bg-[#1e293b]/70 backdrop-blur-sm rounded-xl border border-white/[0.08] p-8 flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#06b6d4]/20 to-violet-500/20 flex items-center justify-center mb-6">
          <MessageSquareText className="w-8 h-8 text-[#06b6d4]" />
        </div>
        <h2 className="text-xl font-semibold text-[#f8fafc] mb-2">Import data to get started</h2>
        <p className="text-sm text-[#94a3b8] max-w-md text-center mb-8">
          Ask PlatoVue uses your recruiting data to provide personalized insights and recommendations.
          Import your data to unlock these features.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-50 pointer-events-none max-w-2xl">
          {suggestedQuestions.map((item) => (
            <div
              key={item.question}
              className="text-left p-4 rounded-lg bg-[#1e293b]/90 border border-white/[0.08]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#06b6d4]">{item.icon}</span>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#64748b]">
                  {item.category}
                </span>
              </div>
              <p className="text-sm text-[#f8fafc]">
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

  // Handle adding manual actions
  const handleAddManualActions = (newActions: ActionItem[]) => {
    setManualActions((prev) => {
      const existingIds = new Set(prev.map(a => a.action_id));
      const uniqueNew = newActions.filter(a => !existingIds.has(a.action_id));
      return [...prev, ...uniqueNew];
    });
  };

  // Default navigation handler if none provided
  const handleNavigateToTab = (tab: string, params?: Record<string, string>) => {
    if (onNavigateToTab) {
      onNavigateToTab(tab);
    }
    // Log navigation for debugging
    console.log('[AskPlatoVueV2] Navigate to tab:', tab, params ? `with params: ${JSON.stringify(params)}` : '');
  };

  // Show empty state if no data loaded
  if (!state.loadingState.hasOverviewMetrics || !state.overview) {
    return <AskEmptyState />;
  }

  // Use the new Tailwind-based Ask PlatoVue component
  return <AskPlatoVueTabV2 onNavigateToTab={handleNavigateToTab} />;
}

export default AskPlatoVueV2;
